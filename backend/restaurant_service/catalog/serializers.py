from rest_framework import serializers


class RestaurantInput(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=80)
    cuisineType = serializers.CharField(min_length=2, max_length=60)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    logoUrl = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=512)


class ScheduleInput(serializers.Serializer):
    dayOfWeek = serializers.IntegerField(min_value=1, max_value=7)
    openTime = serializers.TimeField(required=False, allow_null=True)
    closeTime = serializers.TimeField(required=False, allow_null=True)
    isClosed = serializers.BooleanField(required=False, default=False)


class BranchInput(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    address = serializers.CharField(max_length=150)
    city = serializers.CharField(max_length=80)
    phone = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=30)
    latitude = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    longitude = serializers.FloatField(required=False, allow_null=True, min_value=-180, max_value=180)
    capacity = serializers.IntegerField(min_value=1, max_value=500)
    # Como en el backend anterior: si no viene, la sede queda activa.
    active = serializers.BooleanField(required=False, default=True)
    schedules = ScheduleInput(many=True, required=False, allow_null=True)
