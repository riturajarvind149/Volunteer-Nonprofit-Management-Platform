const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const volunteerHoursRepository = require('../repositories/volunteerHoursRepository');
const { config } = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Build a "Certificate of Volunteer Service" PDF listing all VERIFIED hours.
 * A deterministic reference code lets organisations quote the certificate.
 *
 * @param {string} volunteerId
 * @returns {Promise<{buffer: Buffer, filename: string}>}
 */
const generateVolunteerCertificate = async (volunteerId) => {
  const user = await userRepository.findById(volunteerId);
  if (!user) throw new AppError('User not found', 404);

  const entries = await volunteerHoursRepository.findVerifiedForCertificate(volunteerId);
  if (!entries.length) {
    throw new AppError('You have no verified volunteer hours yet. Certificates include verified hours only.', 400);
  }

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const issuedOn = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: config.timezone });
  const reference = crypto
    .createHash('sha256')
    .update(`${user.id}:${totalHours.toFixed(2)}:${entries.length}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Certificate of Volunteer Service', Author: config.appName } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 100;

  // Border
  doc.lineWidth(3).strokeColor('#2563eb').rect(25, 25, pageWidth - 50, doc.page.height - 50).stroke();
  doc.lineWidth(1).strokeColor('#93c5fd').rect(33, 33, pageWidth - 66, doc.page.height - 66).stroke();

  doc.moveDown(2);
  doc.fillColor('#2563eb').font('Helvetica-Bold').fontSize(14).text(config.appName.toUpperCase(), { align: 'center', characterSpacing: 3 });
  doc.moveDown(1.2);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(28).text('Certificate of Volunteer Service', { align: 'center' });
  doc.moveDown(1.2);
  doc.font('Helvetica').fontSize(13).fillColor('#374151').text('This is to certify that', { align: 'center' });
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#111827').text(user.full_name, { align: 'center' });
  doc.moveDown(0.6);
  doc
    .font('Helvetica')
    .fontSize(13)
    .fillColor('#374151')
    .text(
      `has contributed ${totalHours.toFixed(2)} verified hours of volunteer service across ${entries.length} ${
        entries.length === 1 ? 'opportunity' : 'opportunities'
      }.`,
      { align: 'center' }
    );

  // Table
  doc.moveDown(2);
  const colX = [50, 300, 440];
  const header = ['Opportunity / Organization', 'Date', 'Hours'];
  let y = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');
  header.forEach((h, i) => doc.text(h, colX[i] + 5, y, { width: i === 0 ? 240 : 120 }));
  y += 18;
  doc.moveTo(50, y - 4).lineTo(50 + contentWidth, y - 4).strokeColor('#d1d5db').stroke();

  doc.font('Helvetica').fontSize(10).fillColor('#374151');
  for (const e of entries) {
    if (y > doc.page.height - 140) {
      doc.addPage();
      y = 60;
    }
    const label = `${e.opportunity_title} — ${e.organization_name}`;
    const h = doc.heightOfString(label, { width: 240 });
    doc.text(label, colX[0] + 5, y, { width: 240 });
    doc.text(String(e.event_date).slice(0, 10), colX[1] + 5, y, { width: 120 });
    doc.text(e.hours.toFixed(2), colX[2] + 5, y, { width: 80 });
    y += Math.max(h, 12) + 6;
  }
  doc.moveTo(50, y).lineTo(50 + contentWidth, y).strokeColor('#d1d5db').stroke();
  doc.font('Helvetica-Bold').text('Total', colX[1] + 5, y + 6).text(totalHours.toFixed(2), colX[2] + 5, y + 6);

  // Footer
  const footerY = doc.page.height - 110;
  doc.font('Helvetica').fontSize(10).fillColor('#6b7280');
  doc.text(`Issued on ${issuedOn}`, 50, footerY, { width: contentWidth, align: 'center' });
  doc.text(`Certificate reference: ${reference}`, 50, footerY + 16, { width: contentWidth, align: 'center' });
  doc.text('Hours listed were verified by the organizing nonprofit coordinators.', 50, footerY + 32, {
    width: contentWidth,
    align: 'center',
  });

  doc.end();
  await done;

  const safeName = user.full_name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return { buffer: Buffer.concat(chunks), filename: `volunteer-certificate-${safeName}.pdf` };
};

module.exports = { generateVolunteerCertificate };
