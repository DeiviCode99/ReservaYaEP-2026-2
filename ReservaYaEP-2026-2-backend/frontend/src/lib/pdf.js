import { EVENTS, STATUS, formatDate } from "./api";
import { hhmm, reservationCode } from "./format";

/* Confirmación en PDF. jspdf pesa bastante: se carga solo al descargar. */
export async function downloadConfirmation(reservation) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const code = reservationCode(reservation);
  pdf.setTextColor(198, 40, 40);
  pdf.setFontSize(22);
  pdf.text("ReservaYa", 20, 25);
  pdf.setTextColor(42, 26, 20);
  pdf.setFontSize(16);
  pdf.text("Confirmación de reserva", 20, 42);
  pdf.setFontSize(11);
  pdf.text(`Código: ${code}`, 20, 58);
  pdf.text(`Sede: ${reservation.branchName || "No disponible"}`, 20, 70);
  pdf.text(`Fecha: ${formatDate(reservation.reservationDate)}`, 20, 82);
  pdf.text(`Hora: ${hhmm(reservation.reservationTime)}`, 20, 94);
  pdf.text(`Personas: ${reservation.partySize}`, 20, 106);
  pdf.text(`Ocasión: ${EVENTS[reservation.event] || "Ninguna"}`, 20, 118);
  pdf.text(`Estado: ${STATUS[reservation.status]?.[0] || reservation.status}`, 20, 130);
  pdf.setDrawColor(251, 192, 45);
  pdf.line(20, 140, 190, 140);
  pdf.setFontSize(10);
  pdf.setTextColor(107, 95, 84);
  pdf.text("Presenta este código al restaurante.", 20, 153);
  pdf.save(`reserva-${code}.pdf`);
}
