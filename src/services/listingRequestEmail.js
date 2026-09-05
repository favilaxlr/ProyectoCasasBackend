import { getEmailFromAddress, sendEmail } from './twilioEmail.js';
import { wrapEmail, detailRow, buildPhotoGrid, escapeHtml } from './emailLayout.js';

const PROPERTY_TYPE_LABELS = {
    house: 'House',
    apartment: 'Apartment',
    condo: 'Condo',
    townhouse: 'Townhouse',
    vacant_land: 'Urban Land'
};

const sizeLabel = (value, suffix = 'sq ft') => (
    value ? `${Number(value).toLocaleString()} ${suffix}` : 'Not provided'
);

const resolveRecipients = () => {
    const raw = process.env.LISTING_REQUEST_NOTIFY_EMAIL
        || getEmailFromAddress();

    return raw
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
};

export const sendListingRequestNotification = async (listingRequest) => {
    const recipients = resolveRecipients();
    const adminBase = (process.env.BASE_URL_FRONTEND || 'http://localhost:5173').replace(/\/$/, '');
    const adminUrl = `${adminBase}/admin/listing-requests/${listingRequest._id}`;
    const priceLabel = listingRequest.estimatedPrice
        ? `$${Number(listingRequest.estimatedPrice).toLocaleString()}`
        : 'Not provided';
    const typeLabel = PROPERTY_TYPE_LABELS[listingRequest.propertyType] || listingRequest.propertyType;
    const photoCount = listingRequest.images?.length || 0;
    const subject = `New seller request · ${listingRequest.fullName} · ${listingRequest.location}`;

    const bodyHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f7f6;border-radius:14px;">
        <tr>
          <td style="padding:6px 22px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${detailRow('Name', escapeHtml(listingRequest.fullName))}
              ${detailRow('Phone', `<a href="tel:${escapeHtml(listingRequest.phone)}" style="color:#003952;text-decoration:none;font-weight:600;">${escapeHtml(listingRequest.phone)}</a>`)}
              ${detailRow('Email', `<a href="mailto:${escapeHtml(listingRequest.email)}" style="color:#003952;text-decoration:none;font-weight:600;">${escapeHtml(listingRequest.email)}</a>`)}
              ${detailRow('Location', escapeHtml(listingRequest.location))}
              ${detailRow('Type', escapeHtml(typeLabel))}
              ${detailRow('Est. price', escapeHtml(priceLabel))}
              ${detailRow('House size', escapeHtml(sizeLabel(listingRequest.squareFeet)))}
              ${detailRow('Lot size', escapeHtml(sizeLabel(listingRequest.lotSquareFeet)))}
              ${detailRow('Photos', String(photoCount), true)}
            </table>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;color:#64748b;font-weight:700;padding-bottom:10px;">
            Seller notes
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;border-left:4px solid #00b8a9;border-radius:0 12px 12px 0;padding:16px 18px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:26px;color:#1e293b;">
            ${escapeHtml(listingRequest.description || 'No description provided.')}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;color:#64748b;font-weight:700;padding-bottom:10px;">
            Property photos
          </td>
        </tr>
        <tr>
          <td>
            ${buildPhotoGrid(listingRequest.images)}
          </td>
        </tr>
      </table>
    `;

    const html = wrapEmail({
        preheader: `${listingRequest.fullName} submitted a home in ${listingRequest.location}.`,
        eyebrow: 'New inbound lead',
        title: 'A client wants to sell their home',
        intro: 'This is a review request, not an automatic listing. Contact the seller and decide if the property should go live.',
        bodyHtml,
        cta: { href: adminUrl, label: 'Review in admin panel' },
        footerNote: `Contact ${escapeHtml(listingRequest.fullName)} at ${escapeHtml(listingRequest.email)} or ${escapeHtml(listingRequest.phone)}.`
    });

    try {
        const result = await sendEmail({
            to: recipients,
            subject,
            html,
            text: `New sell request from ${listingRequest.fullName} (${listingRequest.email}, ${listingRequest.phone}) in ${listingRequest.location}. Price: ${priceLabel}. Type: ${typeLabel}. Review: ${adminUrl}`
        });
        console.log(`✅ Listing request email sent to ${recipients.join(', ')} (${result.mode})`);
        return { success: true, mode: result.mode, recipients };
    } catch (error) {
        console.error('❌ Error sending listing request email:', error.message);
        return { success: false, error: error.message };
    }
};
