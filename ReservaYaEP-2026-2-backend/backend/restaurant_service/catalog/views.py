from rest_framework.response import Response
from rest_framework.views import APIView

from reservaya_common.drf import AllowAny, IsAuthenticated, current_user, validated
from reservaya_common.errors import Unauthorized

from . import services
from .serializers import BranchInput, RestaurantInput


class PublicReads(APIView):
    """Las lecturas del catálogo son públicas; escribir exige sesión."""

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]


def _filters(request):
    params = request.query_params
    return (params.get("name", "").strip(), params.get("city", "").strip(), params.get("cuisine", "").strip())


class RestaurantsView(PublicReads):
    def get(self, request):
        if request.query_params.get("mine", "").lower() == "true":
            user = current_user(request)
            if user is None:
                raise Unauthorized("Inicia sesión para ver tus restaurantes.")
            return Response(services.my_restaurants(user))
        return Response(services.search_restaurants(*_filters(request)))

    def post(self, request):
        data = validated(RestaurantInput, request.data)
        return Response(services.create_restaurant(data, current_user(request)), status=201)


class RestaurantDetailView(PublicReads):
    def put(self, request, restaurant_id):
        data = validated(RestaurantInput, request.data)
        return Response(services.update_restaurant(restaurant_id, data, current_user(request)))


class BranchSearchView(PublicReads):
    def get(self, request):
        return Response(services.search_branches(*_filters(request)))


class BranchDetailView(PublicReads):
    def get(self, request, branch_id):
        return Response(services.branch_detail(branch_id))


class RestaurantBranchesView(PublicReads):
    def get(self, request, restaurant_id):
        return Response(services.branches_of(restaurant_id))

    def post(self, request, restaurant_id):
        data = validated(BranchInput, request.data)
        return Response(services.create_branch(restaurant_id, data, current_user(request)), status=201)


class RestaurantBranchView(PublicReads):
    def put(self, request, restaurant_id, branch_id):
        data = validated(BranchInput, request.data)
        return Response(services.update_branch(restaurant_id, branch_id, data, current_user(request)))


class InternalAdminCheckView(APIView):
    """Solo entre servicios (el gateway no enruta /internal): ¿el usuario administra la marca?"""

    permission_classes = [AllowAny]

    def get(self, request, restaurant_id, user_id):
        return Response({"isAdmin": services.is_admin(user_id, restaurant_id)})
