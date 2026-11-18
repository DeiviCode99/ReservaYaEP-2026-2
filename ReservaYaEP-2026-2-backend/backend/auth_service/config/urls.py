from django.urls import include, path

from accounts import views
from reservaya_common.drf import health_view

urlpatterns = [
    path("api/auth/", include("accounts.urls")),
    # Solo entre servicios: el gateway no enruta /internal.
    path("internal/users", views.internal_users),
    path("health", health_view("auth-service")),
]
