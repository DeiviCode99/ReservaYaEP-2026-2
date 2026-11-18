from django.urls import path

from . import views

urlpatterns = [
    path("register", views.register),
    path("login", views.login),
    path("config", views.public_config),
    path("google", views.google_login),
    path("forgot-password", views.forgot_password),
    path("reset-password", views.reset_password),
    path("me", views.me),
]
