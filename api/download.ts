import { VercelRequest, VercelResponse } from '@vercel/node';
import chromium from 'chrome-aws-lambda';
import JSZip from 'jszip';
import Cors from 'cors';

const cors = Cors({
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    origin: '*',
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    await runMiddleware(req, res, cors);
    const { htmlContents } = req.body;

    const zip = new JSZip();

    try {
        const browser = await chromium.puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        if (htmlContents.length === 1) {
            const htmlContent = htmlContents[0];
            await page.setContent(htmlContent);

            const screenshotBuffer = await page.screenshot({ fullPage: true });

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Disposition', 'attachment; filename="ticket.png"');
            res.send(screenshotBuffer);
        } else {
            for (let i = 0; i < htmlContents.length; i++) {
                const htmlContent = htmlContents[i];
                await page.setContent(htmlContent);

                const screenshotBuffer = await page.screenshot({ fullPage: true });
                zip.file(`ticket-${i + 1}.png`, screenshotBuffer);
            }

            await browser.close();

            zip.generateAsync({ type: 'nodebuffer' }).then((content) => {
                res.setHeader('Content-Type', 'application/zip');
                res.setHeader('Content-Disposition', 'attachment; filename=tickets.zip');
                res.send(content);
            });
        }
    } catch (err) {
        console.error('Error processing HTML to image', err);
        res.status(500).send('Internal server error');
    }
}
