from django.urls import path, re_path

from proxy import views
from reservaya_common.drf import health_view

urlpatterns = [
    path("health", health_view("gateway")),
    re_path(r"^api/", views.proxy),
]
