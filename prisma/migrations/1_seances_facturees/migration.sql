-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_invoiceId_idx" ON "Appointment"("invoiceId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

