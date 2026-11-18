"""Tablas de reservation_service en schema.sql. Django no las crea ni las modifica.

user_id y branch_id son números: los datos de usuarios y sedes son de otros
servicios y se piden por HTTP.
"""
from django.db import models
from django.utils import timezone


class Reservation(models.Model):
    user_id = models.BigIntegerField()
    customer_email = models.CharField(max_length=255, null=True, blank=True)
    branch_id = models.BigIntegerField()
    reservation_date = models.DateField()
    reservation_time = models.TimeField()  # franja de una hora exacta
    party_size = models.IntegerField()
    event = models.CharField(max_length=30, default="NONE")
    confirmation_code = models.CharField(max_length=40, unique=True)
    status = models.CharField(max_length=20, default="PENDING")
    cancellation_reason = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)  # el trigger lo mantiene en UPDATE

    class Meta:
        managed = False
        db_table = "reservations"

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        super().save(*args, **kwargs)


class ReservationAudit(models.Model):
    reservation_id = models.BigIntegerField()
    actor_user_id = models.BigIntegerField()
    actor_role = models.CharField(max_length=30)
    action = models.CharField(max_length=20)
    previous_status = models.CharField(max_length=20, null=True, blank=True)
    new_status = models.CharField(max_length=20)
    details = models.CharField(max_length=255, null=True, blank=True)
    changed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "reservation_audit"
