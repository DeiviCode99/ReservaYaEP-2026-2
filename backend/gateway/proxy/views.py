from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from reservaya_common.errors import ApiError, error_body

from .routing import FORWARDED_REQUEST_HEADERS, forward, target_url


@csrf_exempt
def proxy(request):
    url = target_url(request.path, request.META.get("QUERY_STRING", ""), settings.SERVICE_ROUTES)
    if url is None:
        return JsonResponse(error_body(404, "Recurso no encontrado."), status=404)
    headers = {name: request.headers.get(name, "") for name in FORWARDED_REQUEST_HEADERS}
    headers["X-Forwarded-For"] = request.META.get("REMOTE_ADDR", "")
    try:
        status, response_headers, body = forward(request.method, url, headers, request.body or None)
    except ApiError as error:
        return JsonResponse(error_body(error.status, error.message), status=error.status)
    response = HttpResponse(body, status=status)
    for name, value in response_headers.items():
        response[name] = value
    return response
