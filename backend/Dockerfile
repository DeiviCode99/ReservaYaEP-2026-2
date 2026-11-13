# Imagen de cualquier microservicio Django. El servicio se elige con el build-arg
# SERVICE (auth_service, restaurant_service, reservation_service o gateway).
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY common /app/common
ARG SERVICE
COPY ${SERVICE} /app/service
WORKDIR /app/service
ENV PORT=8000
EXPOSE 8000
# 2 workers por servicio: Supabase limita las conexiones simultáneas.
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --workers 2 --timeout 30 --access-logfile -"]
