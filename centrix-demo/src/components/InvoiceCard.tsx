import type { Invoice } from '../domain/caseFlow.ts'
import { formatDate, formatMoney } from '../domain/format.ts'

export function InvoiceCard({ invoice, draft = false }: { invoice: Invoice; draft?: boolean }) {
  return (
    <div className="invoice">
      <div className="invoice-head">
        <div>
          <p className="eyebrow">{draft ? 'Invoice preview' : 'Invoice'}</p>
          <p className="invoice-number">{invoice.number}</p>
        </div>
        <p className="invoice-total">{formatMoney(invoice.grossCents)}</p>
      </div>

      <dl className="invoice-meta">
        <div>
          <dt>From</dt>
          <dd>{invoice.from}</dd>
        </div>
        <div>
          <dt>Bill to</dt>
          <dd>{invoice.billTo}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{invoice.reference}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDate(invoice.issuedAt)}</dd>
        </div>
      </dl>

      <table className="invoice-lines">
        <tbody>
          {invoice.lines.map((line, index) => (
            <tr key={index}>
              <td>{line.description}</td>
              <td className="num">{formatMoney(line.amountCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Net</td>
            <td className="num">{formatMoney(invoice.netCents)}</td>
          </tr>
          <tr>
            <td>VAT {invoice.vatRatePercent}%</td>
            <td className="num">{formatMoney(invoice.vatCents)}</td>
          </tr>
          <tr className="invoice-gross">
            <td>Total</td>
            <td className="num">{formatMoney(invoice.grossCents)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
