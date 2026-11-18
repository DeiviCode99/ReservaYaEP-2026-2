"""Tablas de restaurant_service en schema.sql. Django no las crea ni las modifica."""
from django.db import models
from django.utils import timezone


class Timestamped(models.Model):
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)  # el trigger lo mantiene en UPDATE

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        super().save(*args, **kwargs)


class Restaurant(Timestamped):
    """La marca (ej. "Doña Marta"). Tiene 1..N sedes. RF-03, RF-13."""

    name = models.CharField(max_length=80, unique=True)
    cuisine_type = models.CharField(max_length=60)
    description = models.TextField(null=True, blank=True)
    logo_url = models.CharField(max_length=512, null=True, blank=True)

    class Meta:
        managed = False
        db_table = "restaurants"


class Branch(Timestamped):
    """Local físico de una marca. Aquí vive el aforo por franja (RF-07)."""

    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="branches",
                                   db_column="restaurant_id")
    name = models.CharField(max_length=80)
    address = models.CharField(max_length=150)
    city = models.CharField(max_length=80)
    phone = models.CharField(max_length=30, null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    capacity = models.IntegerField()
    active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "branches"


class Schedule(models.Model):
    """Horario semanal. day_of_week ISO-8601: 1 = lunes … 7 = domingo."""

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="schedules", db_column="branch_id")
    day_of_week = models.SmallIntegerField()
    open_time = models.TimeField()
    close_time = models.TimeField()
    is_closed = models.BooleanField(default=False)

    class Meta:
        managed = False
        db_table = "schedules"


class RestaurantAdmin(models.Model):
    """Qué usuario administra qué marca (RF-14). PK compuesta (user_id, restaurant_id)."""

    pk = models.CompositePrimaryKey("user_id", "restaurant")
    user_id = models.BigIntegerField()
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, db_column="restaurant_id")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "restaurant_admins"
