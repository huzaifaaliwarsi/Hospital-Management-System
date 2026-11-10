-- Keep legacy advance rows and their original rate snapshots for audit,
-- but remove their erroneous charge contribution. Receipts remain untouched.
WITH corrected AS (
  UPDATE invoice_line_items l
  SET line_gross = 0, discount_amount = 0, line_net = 0,
      patient_share = 0, panel_receivable = 0,
      discount_reason = concat_ws('; ', l.discount_reason,
        'Advance charge corrected to payment only; original gross=' || l.line_gross || ', net=' || l.line_net)
  FROM service_rates s, hospital_invoices i
  WHERE l.service_rate_id = s.id AND l.hospital_invoice_id = i.id
    AND i.source_type = 'ADMISSION' AND s.code = 'ADM-ADVANCE'
    AND (l.line_gross <> 0 OR l.line_net <> 0)
  RETURNING l.hospital_invoice_id
), totals AS (
  -- The statement snapshot still has original amounts, so exclude advances explicitly.
  SELECT i.id, COALESCE(SUM(l.line_gross) FILTER (WHERE s.code <> 'ADM-ADVANCE'), 0) gross,
    COALESCE(SUM(l.discount_amount) FILTER (WHERE s.code <> 'ADM-ADVANCE'), 0) discount,
    COALESCE(SUM(l.line_net) FILTER (WHERE s.code <> 'ADM-ADVANCE'), 0) net,
    COALESCE(SUM(l.patient_share) FILTER (WHERE s.code <> 'ADM-ADVANCE'), 0) patient,
    COALESCE(SUM(l.panel_receivable) FILTER (WHERE s.code <> 'ADM-ADVANCE'), 0) panel
  FROM hospital_invoices i JOIN invoice_line_items l ON l.hospital_invoice_id = i.id
  JOIN service_rates s ON s.id = l.service_rate_id
  WHERE i.id IN (SELECT hospital_invoice_id FROM corrected) GROUP BY i.id
)
UPDATE hospital_invoices i SET subtotal = t.gross, discount_total = t.discount,
  total = t.net, patient_share = t.patient, panel_receivable = t.panel
FROM totals t WHERE i.id = t.id;

-- Keep the stored status consistent for every totals/payment update, including
-- incremental ward charges, so list filters and documents agree with the ledger.
CREATE FUNCTION derive_hospital_invoice_payment_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status <> 'VOID' THEN
    NEW.status := CASE WHEN NEW.paid_total >= NEW.total THEN 'PAID'::"InvoiceStatus"
      WHEN NEW.paid_total > 0 THEN 'PARTIALLY_PAID'::"InvoiceStatus"
      ELSE 'UNPAID'::"InvoiceStatus" END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER hospital_invoice_payment_status
BEFORE INSERT OR UPDATE ON hospital_invoices
FOR EACH ROW EXECUTE FUNCTION derive_hospital_invoice_payment_status();

UPDATE hospital_invoices SET status = status WHERE status <> 'VOID';
