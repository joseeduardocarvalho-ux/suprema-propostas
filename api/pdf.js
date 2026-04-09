const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { css, slidesHtml, filename } = req.body;
  if (!slidesHtml) {
    return res.status(400).json({ error: 'Missing slidesHtml' });
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${css || ''}
html,body{margin:0;padding:0;background:#000;width:1280px;}
.slide{width:1280px!important;height:720px!important;overflow:hidden!important;position:relative!important;display:block!important;box-sizing:border-box!important;}
</style>
</head>
<body>${slidesHtml}</body>
</html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 25000 });

    // Wait for images to render
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = img.onerror = resolve;
          }))
      );
    });

    const pdfBuffer = await page.pdf({
      printBackground: true,
      width: '1280px',
      height: '720px',
      pageRanges: '',
    });

    await browser.close();

    const safeFilename = (filename || 'Suprema_Proposta').replace(/[^a-zA-Z0-9_\-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
  maxDuration: 60,
};
