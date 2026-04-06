import re

from flask_wtf import FlaskForm
from wtforms import BooleanField, EmailField, PasswordField, StringField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo, Length, ValidationError


PASSWORD_RULE = (
    'Password must be at least 10 characters and include uppercase, lowercase, '
    'and a number.'
)


def validate_password_strength(form, field) -> None:
    value = field.data or ''
    if len(value) < 10:
        raise ValidationError(PASSWORD_RULE)
    if not re.search(r'[A-Z]', value):
        raise ValidationError(PASSWORD_RULE)
    if not re.search(r'[a-z]', value):
        raise ValidationError(PASSWORD_RULE)
    if not re.search(r'\d', value):
        raise ValidationError(PASSWORD_RULE)


class SignUpForm(FlaskForm):
    full_name = StringField('Full name', validators=[DataRequired(), Length(max=120)])
    email = EmailField('Email', validators=[DataRequired(), Email(), Length(max=255)])
    password = PasswordField(
        'Password',
        validators=[DataRequired(), validate_password_strength]
    )
    confirm_password = PasswordField(
        'Confirm password',
        validators=[DataRequired(), EqualTo('password', message='Passwords must match.')]
    )
    remember_me = BooleanField('Keep me signed in')
    submit = SubmitField('Create account')


class SignInForm(FlaskForm):
    email = EmailField('Email', validators=[DataRequired(), Email(), Length(max=255)])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Keep me signed in')
    submit = SubmitField('Sign in')
