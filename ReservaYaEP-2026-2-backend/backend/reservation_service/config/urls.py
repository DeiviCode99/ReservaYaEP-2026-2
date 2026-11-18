from django.urls import path

from bookings import views
from reservaya_common.drf import health_view

urlpatterns = [
    path("api/reservations", views.ReservationsView.as_view()),
    path("api/reservations/availability", views.AvailabilityView.as_view()),
    path("api/reservations/<int:reservation_id>", views.ReservationDetailView.as_view()),
    path("api/reservations/<int:reservation_id>/status", views.ReservationStatusView.as_view()),
    path("health", health_view("reservation-service")),
]
