import json
import os
from threading import Lock
from urllib.parse import urljoin, urlsplit

from flask import (
    Flask,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)
from flask_cors import CORS
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy.exc import OperationalError
from werkzeug.utils import secure_filename

from auth_forms import SignInForm, SignUpForm
from auth_models import ApiToken, PredictionHistory, User, hash_token, utcnow
from config import Config
from extensions import csrf, db, login_manager
from models.audio_classifier import AudioClassifier
from models.image_classifier import ImageClassifier


def normalize_email(value: str) -> str:
    return (value or '').strip().lower()


def is_safe_redirect_target(target: str | None) -> bool:
    if not target:
        return False

    ref_url = urlsplit(request.host_url)
    test_url = urlsplit(urljoin(request.host_url, target))
    return test_url.scheme in {'http', 'https'} and ref_url.netloc == test_url.netloc


def next_redirect_target(default_endpoint: str = 'index') -> str:
    target = request.args.get('next') or request.form.get('next')
    if is_safe_redirect_target(target):
        return target
    return url_for(default_endpoint)


def json_error(message: str, status_code: int):
    return jsonify({'error': message}), status_code


app = Flask(__name__)
app.config.from_object(Config)

CORS(
    app,
    resources={r'/api/*': {'origins': app.config['CORS_ALLOWED_ORIGINS']}},
    supports_credentials=True
)

db.init_app(app)
login_manager.init_app(app)
csrf.init_app(app)

login_manager.login_view = 'signin'
login_manager.login_message = 'Please sign in to continue.'
login_manager.login_message_category = 'warning'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

image_model = None
audio_model = None
bird_info = None
image_model_lock = Lock()
audio_model_lock = Lock()
bird_info_lock = Lock()


@login_manager.user_loader
def load_user(user_id: str):
    return db.session.get(User, user_id)


@login_manager.unauthorized_handler
def unauthorized():
    if request.path.startswith('/api/'):
        return json_error('Authentication required.', 401)
    flash('Please sign in to continue.', 'warning')
    return redirect(url_for('signin', next=request.url))


@app.context_processor
def inject_auth_state():
    return {'current_year': utcnow().year}


def create_user(full_name: str, email: str, password: str) -> User:
    user = User(full_name=full_name.strip(), email=normalize_email(email))
    user.set_password(password)
    db.session.add(user)
    return user


def get_image_model():
    global image_model

    if image_model is None:
        with image_model_lock:
            if image_model is None:
                image_model = ImageClassifier(
                    model_path='models/best_cub200_efficientnet_b5.pth'
                )
    return image_model


def get_audio_model():
    global audio_model

    if audio_model is None:
        with audio_model_lock:
            if audio_model is None:
                audio_model = AudioClassifier(weights_dir='models/weights')
    return audio_model


def get_bird_info():
    global bird_info

    if bird_info is None:
        with bird_info_lock:
            if bird_info is None:
                try:
                    with open('bird_info.json', 'r', encoding='utf-8') as file:
                        bird_info = json.load(file)
                except Exception as exc:
                    print(f'Error loading bird_info.json: {exc}')
                    bird_info = {}
    return bird_info


def bearer_token_record():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None

    raw_token = header.removeprefix('Bearer ').strip()
    if not raw_token:
        return None

    token = ApiToken.query.filter_by(token_hash=hash_token(raw_token)).first()
    if token is None or not token.is_valid() or not token.user.is_active:
        return None

    token.touch()
    db.session.commit()
    return token


def authenticated_api_user():
    if current_user.is_authenticated:
        return current_user

    token = bearer_token_record()
    if token is None:
        return None
    return token.user


def issue_api_token_for(user: User) -> str:
    raw_token, _ = ApiToken.issue_for_user(user, app.config['API_TOKEN_TTL_DAYS'])
    return raw_token


def sign_in_user(user: User, remember_me: bool) -> None:
    user.last_login_at = utcnow()
    login_user(user, remember=remember_me)
    db.session.commit()


def prediction_display_name(prediction: dict) -> str:
    details = prediction.get('details') or {}
    return details.get('common_name') or prediction.get('species') or 'Unknown species'


def create_prediction_history(
    user: User,
    file_type: str,
    source_filename: str,
    predictions: list[dict],
) -> PredictionHistory:
    top_prediction = predictions[0] if predictions else {}
    history_entry = PredictionHistory(
        user=user,
        input_type=file_type,
        source_filename=source_filename,
        top_species=prediction_display_name(top_prediction),
        top_confidence=float(top_prediction.get('confidence') or 0.0),
        predictions=predictions,
    )
    db.session.add(history_entry)
    return history_entry


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/healthz')
def healthz():
    return jsonify({'status': 'ok'}), 200


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    form = SignUpForm()
    if form.validate_on_submit():
        email = normalize_email(form.email.data)
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            form.email.errors.append('An account with this email already exists.')
        else:
            user = create_user(form.full_name.data, email, form.password.data)
            db.session.commit()
            sign_in_user(user, form.remember_me.data)
            flash('Account created successfully.', 'success')
            return redirect(next_redirect_target())

    return render_template('auth/signup.html', form=form, next_url=request.args.get('next'))


@app.route('/signin', methods=['GET', 'POST'])
def signin():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    form = SignInForm()
    if form.validate_on_submit():
        email = normalize_email(form.email.data)
        user = User.query.filter_by(email=email).first()

        if user is None or not user.check_password(form.password.data):
            form.password.errors.append('Invalid email or password.')
        elif not user.is_active:
            form.email.errors.append('This account is disabled.')
        else:
            sign_in_user(user, form.remember_me.data)
            flash('Signed in successfully.', 'success')
            return redirect(next_redirect_target())

    return render_template('auth/signin.html', form=form, next_url=request.args.get('next'))


@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    flash('You have been signed out.', 'success')
    return redirect(url_for('signin'))


@app.route('/api/auth/signup', methods=['POST'])
@csrf.exempt
def api_signup():
    payload = request.get_json(silent=True) or {}

    full_name = (payload.get('full_name') or '').strip()
    email = normalize_email(payload.get('email', ''))
    password = payload.get('password') or ''

    if not full_name:
        return json_error('Full name is required.', 400)
    if not email:
        return json_error('Email is required.', 400)
    if len(password) < 10:
        return json_error('Password does not meet the minimum security requirements.', 400)
    if User.query.filter_by(email=email).first():
        return json_error('An account with this email already exists.', 409)

    user = create_user(full_name, email, password)
    token = issue_api_token_for(user)
    db.session.commit()

    return jsonify({
        'message': 'Account created successfully.',
        'token_type': 'Bearer',
        'access_token': token,
        'user': user.to_dict(),
    }), 201


@app.route('/api/auth/signin', methods=['POST'])
@csrf.exempt
def api_signin():
    payload = request.get_json(silent=True) or {}
    email = normalize_email(payload.get('email', ''))
    password = payload.get('password') or ''

    user = User.query.filter_by(email=email).first()
    if user is None or not user.check_password(password):
        return json_error('Invalid email or password.', 401)
    if not user.is_active:
        return json_error('This account is disabled.', 403)

    user.last_login_at = utcnow()
    token = issue_api_token_for(user)
    db.session.commit()

    return jsonify({
        'message': 'Signed in successfully.',
        'token_type': 'Bearer',
        'access_token': token,
        'user': user.to_dict(),
    })


@app.route('/api/auth/me', methods=['GET'])
def api_me():
    user = authenticated_api_user()
    if user is None:
        return json_error('Authentication required.', 401)
    return jsonify({'user': user.to_dict()})


@app.route('/api/auth/logout', methods=['POST'])
@csrf.exempt
def api_logout():
    token = bearer_token_record()
    if token is not None:
        token.revoke()
        db.session.commit()

    if current_user.is_authenticated:
        logout_user()

    return jsonify({'message': 'Signed out successfully.'})


@app.route('/api/history', methods=['GET'])
def api_history():
    user = authenticated_api_user()
    if user is None:
        return json_error('Authentication required.', 401)

    try:
        limit = max(1, min(int(request.args.get('limit', '25')), 100))
    except ValueError:
        limit = 25

    history_entries = (
        PredictionHistory.query
        .filter_by(user_id=user.id)
        .order_by(PredictionHistory.created_at.desc())
        .limit(limit)
        .all()
    )

    return jsonify({
        'history': [entry.to_summary_dict() for entry in history_entries],
    })


@app.route('/api/history/<history_id>', methods=['GET'])
def api_history_detail(history_id: str):
    user = authenticated_api_user()
    if user is None:
        return json_error('Authentication required.', 401)

    history_entry = PredictionHistory.query.filter_by(
        id=history_id,
        user_id=user.id,
    ).first()
    if history_entry is None:
        return json_error('History entry not found.', 404)

    return jsonify({
        'history_entry': history_entry.to_detail_dict(),
    })


@app.route('/api/predict', methods=['POST'])
def predict():
    user = authenticated_api_user()
    if user is None:
        return json_error('Authentication required.', 401)

    if 'file' not in request.files:
        return json_error('No file part.', 400)

    file = request.files['file']
    if file.filename == '':
        return json_error('No selected file.', 400)

    file_type = request.form.get('type')
    if not file_type:
        return json_error('No type specified.', 400)

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        loaded_bird_info = get_bird_info()
        if file_type == 'image':
            predictions = get_image_model().predict(filepath)
        elif file_type == 'audio':
            predictions = get_audio_model().predict(filepath)
            for prediction in predictions:
                prediction['species'] = prediction['species'].replace('_sound', '')
        else:
            return json_error('Invalid type.', 400)

        for prediction in predictions:
            species_key = prediction['species']
            prediction['details'] = loaded_bird_info.get(species_key)

        history_entry = create_prediction_history(user, file_type, filename, predictions)
        db.session.commit()

        return jsonify({
            'predictions': predictions,
            'history_entry': history_entry.to_detail_dict(),
            'user': user.to_dict(),
        })
    except Exception as exc:
        return json_error(str(exc), 500)
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


with app.app_context():
    if app.config.get('AUTO_CREATE_DB'):
        try:
            db.create_all()
        except OperationalError as exc:
            print(f'Database initialization skipped: {exc}')


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    )
