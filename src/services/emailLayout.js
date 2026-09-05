export const BRAND = {
    navy: '#050914',
    teal: '#003952',
    accent: '#00b8a9',
    mint: '#5eead4',
    ink: '#0f172a',
    text: '#1e293b',
    muted: '#64748b',
    cream: '#f4f7f6',
    white: '#ffffff',
    line: 'rgba(255,255,255,0.12)',
    cardLine: '#e2e8f0'
};

export const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const siteUrl = () => (process.env.BASE_URL_FRONTEND || 'http://localhost:5173').replace(/\/$/, '');

const brandMark = () => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
      <tr>
        <td align="center" style="padding:0 0 10px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="42" height="42" align="center" valign="middle" style="background-color:${BRAND.accent};border-radius:12px;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:700;letter-spacing:1px;color:${BRAND.navy};">
                FR
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:26px;color:${BRAND.white};letter-spacing:1px;">
          FR Family Investments
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:${BRAND.mint};">
          Real Estate
        </td>
      </tr>
    </table>
`;

export const wrapEmail = ({ preheader = '', eyebrow = '', title, intro = '', bodyHtml, cta, footerNote }) => {
    const ctaHtml = cta?.href ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 0;">
        <tr>
          <td align="center" bgcolor="${BRAND.accent}" style="background-color:${BRAND.accent};border-radius:10px;">
            <a href="${escapeHtml(cta.href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.3px;color:${BRAND.navy};text-decoration:none;">
              ${escapeHtml(cta.label || 'Open')}
            </a>
          </td>
        </tr>
      </table>
    ` : '';

    const eyebrowHtml = eyebrow ? `
      <tr>
        <td align="left" style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.accent};font-weight:700;">
          ${escapeHtml(eyebrow)}
        </td>
      </tr>
    ` : '';

    const introHtml = intro ? `
      <tr>
        <td style="padding:0 0 22px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${BRAND.muted};">
          ${intro}
        </td>
      </tr>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.navy};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.navy};">
    <tr>
      <td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <tr>
            <td style="background-color:${BRAND.teal};border-radius:20px 20px 0 0;padding:32px 28px 28px;">
              ${brandMark()}
            </td>
          </tr>
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background-color:${BRAND.accent};">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:${BRAND.white};padding:36px 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${eyebrowHtml}
                <tr>
                  <td style="padding:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:34px;color:${BRAND.ink};">
                    ${escapeHtml(title)}
                  </td>
                </tr>
                ${introHtml}
                <tr>
                  <td>
                    ${bodyHtml}
                  </td>
                </tr>
                ${ctaHtml ? `<tr><td style="padding-top:28px;">${ctaHtml}</td></tr>` : ''}
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#03111c;border-radius:0 0 20px 20px;padding:22px 28px 26px;">
              <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${BRAND.mint};">
                ${footerNote || 'FR Family Investments'}
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#7dd3c7;">
                <a href="${escapeHtml(siteUrl())}" style="color:#7dd3c7;text-decoration:none;">frfamilyinvestments.com</a>
                &nbsp;·&nbsp; Confidential client communication
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const detailRow = (label, valueHtml, isLast = false) => `
  <tr>
    <td style="padding:13px 0;border-bottom:${isLast ? 'none' : `1px solid ${BRAND.cardLine}`};width:34%;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.6px;text-transform:uppercase;color:${BRAND.muted};font-weight:700;">
      ${escapeHtml(label)}
    </td>
    <td style="padding:13px 0;border-bottom:${isLast ? 'none' : `1px solid ${BRAND.cardLine}`};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};">
      ${valueHtml}
    </td>
  </tr>
`;

export const cloudinaryThumb = (url, width = 260, height = 180) => {
    if (!url || !url.includes('/upload/')) return url;
    return url.replace('/upload/', `/upload/c_fill,g_auto,w_${width},h_${height},q_auto,f_auto/`);
};

export const buildPhotoGrid = (images = []) => {
    if (!images.length) {
        return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.cream};border-radius:12px;">
            <tr>
              <td align="center" style="padding:22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.muted};">
                No photos were attached
              </td>
            </tr>
          </table>
        `;
    }

    const photos = images.slice(0, 10);
    const rows = [];
    for (let i = 0; i < photos.length; i += 2) {
        const left = photos[i];
        const right = photos[i + 1];
        const cell = (image) => image ? `
          <td width="50%" valign="top" style="padding:4px;">
            <a href="${escapeHtml(image.url)}" target="_blank" style="display:block;text-decoration:none;">
              <img src="${escapeHtml(cloudinaryThumb(image.url))}" alt="Property photo" width="260" style="display:block;width:100%;max-width:260px;height:auto;border-radius:10px;border:1px solid ${BRAND.cardLine};" />
            </a>
          </td>
        ` : '<td width="50%" style="padding:4px;">&nbsp;</td>';
        rows.push(`<tr>${cell(left)}${cell(right)}</tr>`);
    }

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.join('')}
      </table>
    `;
};
