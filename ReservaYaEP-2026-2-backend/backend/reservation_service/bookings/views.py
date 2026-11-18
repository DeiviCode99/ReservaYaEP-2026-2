from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from reservaya_common.drf import AllowAny, current_user, validated
from reservaya_common.errors import Unprocessable

from . import services
from .serializers import CancelInput, ReservationInput, StatusInput


def _date(params, name):
    value = params.get(name)
    if not value:
        return None
    try:
        return serializers.DateField().to_internal_value(value)
    except serializers.ValidationError as error:
        raise Unprocessable(f"{name}: fecha no válida (usa AAAA-MM-DD).") from error


class AvailabilityView(APIView):
    """Franjas con cupo de una sede en una fecha (RF-05). Pública: se puede
    consultar antes de iniciar sesión."""

    permission_classes = [AllowAny]

    def get(self, request):
        branch_id = request.query_params.get("branchId", "")
        day = _date(request.query_params, "date")
        if not branch_id.isdigit() or day is None:
            raise Unprocessable("Indica branchId y date (AAAA-MM-DD).")
        return Response(services.availability_for(int(branch_id), day))


class ReservationsView(APIView):
    def get(self, request):
        params = request.query_params
        user = current_user(request)
        day, start, end = _date(params, "date"), _date(params, "from"), _date(params, "to")
        status = params.get("status")
        branch_id = params.get("branchId")
        if branch_id:
            if not branch_id.isdigit():
                raise Unprocessable("branchId no válido.")
            if day is None and start is None and end is None:
                raise Unprocessable("El filtro por fecha requiere una fecha o un rango.")
            first, last = (day, day) if day else (start, end)
            return Response(services.branch_reservations(int(branch_id), first, last, status, user,
                                                         request.META.get("HTTP_AUTHORIZATION", "")))
        if day or start or end or status:
            raise Unprocessable("El filtro por fecha requiere una sede.")
        return Response(services.my_reservations(user))

    def post(self, request):
        data = validated(ReservationInput, request.data)
        return Response(services.create(data, current_user(request)), status=201)


class ReservationDetailView(APIView):
    def put(self, request, reservation_id):
        data = validated(ReservationInput, request.data)
        return Response(services.update(reservation_id, data, current_user(request)))

    def patch(self, request, reservation_id):
        data = validated(CancelInput, request.data or {})
        return Response(services.cancel(reservation_id, data.get("cancellationReason"), current_user(request)))


class ReservationStatusView(APIView):
    def patch(self, request, reservation_id):
        data = validated(StatusInput, request.data)
        return Response(services.update_status(reservation_id, data["status"], data.get("cancellationReason"),
                                               current_user(request)))
