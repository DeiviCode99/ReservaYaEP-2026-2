from rest_framework import serializers

from .availability import now_local
from .domain import EVENTS


class ReservationInput(serializers.Serializer):
    branchId = serializers.IntegerField(min_value=1)
    reservationDate = serializers.DateField()
    reservationTime = serializers.TimeField()
    partySize = serializers.IntegerField(min_value=1, max_value=50)
    event = serializers.ChoiceField(choices=EVENTS, required=False, default="NONE")

    def validate_reservationDate(self, value):
        if value < now_local().date():
            raise serializers.ValidationError("debe ser una fecha de hoy o futura.")
        return value


class StatusInput(serializers.Serializer):
    status = serializers.CharField()
    cancellationReason = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=255)


class CancelInput(serializers.Serializer):
    cancellationReason = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=255)
