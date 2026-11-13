"""Validación de los cuerpos de entrada (mismas reglas que el backend anterior)."""
from rest_framework import serializers

from .rules import valid_email

INVALID_EMAIL = "Ingresa un correo electrónico válido."


class EmailField(serializers.CharField):
    def __init__(self, **kwargs):
        super().__init__(max_length=255, **kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not valid_email(value):
            raise serializers.ValidationError(INVALID_EMAIL)
        return value


class PasswordField(serializers.CharField):
    def __init__(self, **kwargs):
        kwargs.setdefault("min_length", 8)
        kwargs.setdefault("max_length", 72)
        super().__init__(trim_whitespace=False, **kwargs)


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=80)
    email = EmailField()
    password = PasswordField()
    role = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class LoginSerializer(serializers.Serializer):
    email = EmailField()
    password = serializers.CharField(trim_whitespace=False)


class GoogleSerializer(serializers.Serializer):
    credential = serializers.CharField()
    role = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class ForgotPasswordSerializer(serializers.Serializer):
    email = EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = PasswordField()
