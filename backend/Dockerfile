# Imagen de cualquier microservicio. El servicio se elige con el build-arg SERVICE
# (ver docker-compose.yml). Se usa Maven de la imagen en vez de mvnw para evitar
# problemas de fin de linea (CRLF) al clonar desde Windows.
FROM maven:3.9-eclipse-temurin-21 AS build
ARG SERVICE
WORKDIR /app
COPY ${SERVICE}/pom.xml .
COPY ${SERVICE}/src src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:21-jre
COPY --from=build /app/target/*.jar /app.jar
ENTRYPOINT ["java", "-jar", "/app.jar"]
