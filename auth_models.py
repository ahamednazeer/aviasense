import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow
    )
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)
    api_tokens = db.relationship(
        'ApiToken',
        back_populates='user',
        lazy='dynamic',
        cascade='all, delete-orphan'
    )
    prediction_history = db.relationship(
        'PredictionHistory',
        back_populates='user',
        lazy='dynamic',
        cascade='all, delete-orphan'
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'full_name': self.full_name,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
        }


class ApiToken(db.Model):
    __tablename__ = 'api_tokens'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    last_used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)
    user = db.relationship('User', back_populates='api_tokens')

    @classmethod
    def issue_for_user(cls, user: User, ttl_days: int) -> tuple[str, 'ApiToken']:
        raw_token = secrets.token_urlsafe(48)
        token = cls(
            user=user,
            token_hash=hash_token(raw_token),
            expires_at=utcnow() + timedelta(days=ttl_days)
        )
        db.session.add(token)
        return raw_token, token

    def is_valid(self) -> bool:
        return self.revoked_at is None and self.expires_at > utcnow()

    def touch(self) -> None:
        self.last_used_at = utcnow()

    def revoke(self) -> None:
        self.revoked_at = utcnow()


class PredictionHistory(db.Model):
    __tablename__ = 'prediction_history'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    input_type = db.Column(db.String(16), nullable=False)
    source_filename = db.Column(db.String(255), nullable=True)
    top_species = db.Column(db.String(255), nullable=False)
    top_confidence = db.Column(db.Float, nullable=False, default=0.0)
    predictions = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    user = db.relationship('User', back_populates='prediction_history')

    def to_summary_dict(self) -> dict:
        return {
            'id': self.id,
            'input_type': self.input_type,
            'source_filename': self.source_filename,
            'top_species': self.top_species,
            'top_confidence': self.top_confidence,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def to_detail_dict(self) -> dict:
        return {
            **self.to_summary_dict(),
            'predictions': self.predictions,
        }
