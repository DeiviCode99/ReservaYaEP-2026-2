from django.urls import path

from catalog import views
from reservaya_common.drf import health_view

urlpatterns = [
    path("api/restaurants", views.RestaurantsView.as_view()),
    path("api/restaurants/branches", views.BranchSearchView.as_view()),
    path("api/restaurants/branches/<int:branch_id>", views.BranchDetailView.as_view()),
    path("api/restaurants/<int:restaurant_id>", views.RestaurantDetailView.as_view()),
    path("api/restaurants/<int:restaurant_id>/branches", views.RestaurantBranchesView.as_view()),
    path("api/restaurants/<int:restaurant_id>/branches/<int:branch_id>", views.RestaurantBranchView.as_view()),
    # Solo entre servicios: el gateway no enruta /internal.
    path("internal/restaurants/<int:restaurant_id>/admins/<int:user_id>", views.InternalAdminCheckView.as_view()),
    path("health", health_view("restaurant-service")),
]
