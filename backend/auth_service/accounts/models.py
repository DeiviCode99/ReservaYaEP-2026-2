from django.db import models
from django.utils import timezone


class User(models.Model):
    """Tabla `users` de schema.sql. Django no la crea ni la modifica (managed=False)."""

    name = models.CharField(max_length=80)
    email = models.CharField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=100)  # BCrypt (RNF-03)
    role = models.CharField(max_length=20, default="CLIENT")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)  # el trigger lo mantiene en UPDATE

    class Meta:
        managed = False
        db_table = "users"

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        super().save(*args, **kwargs)
