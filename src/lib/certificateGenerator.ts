export interface CertificateData {
  userName: string;
  formationTitle: string;
  certificateCode: string;
  issuedBy: string;
  issuedAt: any;
  pdfUrl?: string;
}

export function openCertificate(cert: CertificateData): void {
  // If admin provided a direct PDF link, open it
  if (cert.pdfUrl) {
    window.open(cert.pdfUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  // Otherwise generate a printable HTML certificate
  printCertificate(cert);
}

export function printCertificate(cert: CertificateData): void {
  const date = cert.issuedAt?.seconds
    ? new Date(cert.issuedAt.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Certificat — ${cert.userName}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      background: #f0f4ff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .toolbar {
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 10px;
      z-index: 100;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      border: none;
    }
    .btn-print { background: #1e40af; color: white; }
    .btn-close { background: #e5e7eb; color: #374151; }
    .page {
      width: 277mm;
      height: 195mm;
      background: white;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 14mm 22mm 20mm 22mm;
      box-shadow: 0 25px 60px rgba(30,64,175,0.18);
      overflow: hidden;
    }
    .border-outer {
      position: absolute;
      inset: 5mm;
      border: 2.5px solid #1e40af;
      pointer-events: none;
    }
    .border-inner {
      position: absolute;
      inset: 8mm;
      border: 0.8px solid #bfdbfe;
      pointer-events: none;
    }
    .corner {
      position: absolute;
      width: 18mm;
      height: 18mm;
      pointer-events: none;
    }
    .c-tl { top: 3mm; left: 3mm; border-top: 3px solid #1e40af; border-left: 3px solid #1e40af; }
    .c-tr { top: 3mm; right: 3mm; border-top: 3px solid #1e40af; border-right: 3px solid #1e40af; }
    .c-bl { bottom: 3mm; left: 3mm; border-bottom: 3px solid #1e40af; border-left: 3px solid #1e40af; }
    .c-br { bottom: 3mm; right: 3mm; border-bottom: 3px solid #1e40af; border-right: 3px solid #1e40af; }
    .bg-watermark {
      position: absolute;
      font-size: 130pt;
      font-weight: 900;
      color: rgba(30,64,175,0.03);
      font-family: Arial, sans-serif;
      letter-spacing: -4px;
      user-select: none;
      pointer-events: none;
      top: 50%;
      left: 50%;
      transform: translate(-50%,-50%);
    }
    .seal {
      position: absolute;
      right: 17mm;
      bottom: 14mm;
      width: 24mm;
      height: 24mm;
      border-radius: 50%;
      background: linear-gradient(135deg, #1e40af, #3b82f6);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 6.5pt;
      font-weight: bold;
      text-align: center;
      letter-spacing: 1.5pt;
      font-family: Arial, sans-serif;
      border: 2px solid #93c5fd;
      text-transform: uppercase;
    }
    .seal-ring {
      position: absolute;
      right: 15.5mm;
      bottom: 12.5mm;
      width: 27mm;
      height: 27mm;
      border-radius: 50%;
      border: 1px dashed #bfdbfe;
    }
    .logo {
      font-size: 26pt;
      font-weight: 900;
      color: #1e40af;
      letter-spacing: -1px;
      font-family: Arial, sans-serif;
      margin-bottom: 1mm;
    }
    .cert-type {
      font-size: 8pt;
      color: #6b7280;
      letter-spacing: 5pt;
      text-transform: uppercase;
      font-family: Arial, sans-serif;
      margin-bottom: 5mm;
    }
    .divider {
      width: 70mm;
      height: 1.5px;
      background: linear-gradient(90deg, transparent, #1e40af 30%, #3b82f6 70%, transparent);
      margin-bottom: 5mm;
    }
    .certify {
      font-size: 10.5pt;
      color: #6b7280;
      font-style: italic;
      margin-bottom: 3mm;
    }
    .student {
      font-size: 24pt;
      color: #111827;
      font-style: italic;
      text-align: center;
      padding-bottom: 3mm;
      border-bottom: 2px solid #1e40af;
      margin-bottom: 4mm;
      min-width: 100mm;
    }
    .completed {
      font-size: 9.5pt;
      color: #6b7280;
      font-family: Arial, sans-serif;
      margin-bottom: 2mm;
    }
    .course {
      font-size: 15pt;
      color: #1e40af;
      font-weight: bold;
      text-align: center;
      font-family: Arial, sans-serif;
      margin-bottom: 0;
      max-width: 170mm;
    }
    .footer-row {
      position: absolute;
      bottom: 11mm;
      left: 14mm;
      right: 50mm;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #9ca3af;
      font-family: Arial, sans-serif;
    }
    .footer-col { text-align: center; min-width: 40mm; }
    .footer-col strong { display: block; color: #4b5563; font-size: 8pt; margin-bottom: 2px; }
    .footer-col .sig-line { width: 35mm; height: 1px; background: #d1d5db; margin: 0 auto 2px; }
    .code-line { font-family: 'Courier New', monospace; font-size: 6.5pt; color: #d1d5db; position: absolute; bottom: 6mm; left: 50%; transform: translateX(-50%); white-space: nowrap; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="btn btn-print" onclick="window.print()">🖨️ Imprimer / Enregistrer PDF</button>
    <button class="btn btn-close" onclick="window.close()">✕ Fermer</button>
  </div>

  <div class="page">
    <div class="border-outer"></div>
    <div class="border-inner"></div>
    <div class="corner c-tl"></div>
    <div class="corner c-tr"></div>
    <div class="corner c-bl"></div>
    <div class="corner c-br"></div>
    <div class="bg-watermark">SOLUTIONPAM</div>

    <div class="seal-ring"></div>
    <div class="seal">SOLUTIONPAM<br>✦<br>CERTIFIÉ</div>

    <div class="logo">SOLUTIONPAM</div>
    <div class="cert-type">Certificat de Réussite</div>
    <div class="divider"></div>
    <div class="certify">Ce certificat est fièrement décerné à</div>
    <div class="student">${escapeHtml(cert.userName)}</div>
    <div class="completed">pour avoir complété avec succès la formation</div>
    <div class="course">${escapeHtml(cert.formationTitle)}</div>

    <div class="footer-row">
      <div class="footer-col">
        <div class="sig-line"></div>
        <strong>Date d'émission</strong>
        ${date}
      </div>
      <div class="footer-col">
        <div class="sig-line"></div>
        <strong>Signé par</strong>
        ${escapeHtml(cert.issuedBy)}
      </div>
    </div>
    <div class="code-line">Réf. certificat : ${escapeHtml(cert.certificateCode)}</div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1180,height=860,resizable=yes,scrollbars=yes');
  if (!win) {
    alert('Veuillez autoriser les popups pour télécharger le certificat.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
