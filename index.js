const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const YEMOT_TOKEN = process.env.YEMOT_TOKEN;
const RECORDING_FOLDER = process.env.RECORDING_FOLDER;

// משתנה ששומר את שם הקובץ האחרון שנשלח
let lastSentFile = '';

app.get('/api/isalive', (req, res) => {
    res.status(200).send('alive');
});

app.get('/api/send-latest-record', async (req, res) => {
    // עונים מיד למערכת כדי לנתק את השיחה
    res.send('id_list_message=t-ההקלטה נשלחה&hangup=yes');

    // המשך הטיפול ברקע
    try {
        const dirUrl = `https://www.call2all.co.il/ym/api/GetIVR2Dir?token=${YEMOT_TOKEN}&path=${RECORDING_FOLDER}&filesLimit=3&orderBy=date&orderDir=desc`;
        const dirResponse = await axios.get(dirUrl);

        const audioFiles = dirResponse.data.files.filter(f => f.name.endsWith('.wav'));

        if (!audioFiles || audioFiles.length === 0) {
            console.log('לא נמצאו קבצי שמע בתיקייה.');
            return;
        }

        const latestFileName = audioFiles[0].name;

        // אם הקובץ כבר נשלח - לא שולחים שוב
        if (latestFileName === lastSentFile) {
            console.log('--- הקובץ הזה כבר נשלח. מתעלם... ---');
            return;
        }

        lastSentFile = latestFileName;

        // מאפסים את שם הקובץ אחרי 10 שניות
        setTimeout(() => {
            lastSentFile = '';
        }, 10000);

        // הורדת הקובץ
        const audioUrl = `https://www.call2all.co.il/ym/api/DownloadFile?token=${YEMOT_TOKEN}&path=${RECORDING_FOLDER}/${latestFileName}`;
        const audioResponse = await axios.get(audioUrl, { responseType: 'stream' });

        // שליחה לטלגרם
        const form = new FormData();
        form.append('chat_id', CHAT_ID);
        form.append('audio', audioResponse.data, latestFileName);

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendAudio`, form, {
            headers: form.getHeaders(),
        });

        console.log('ההקלטה נשלחה לטלגרם בהצלחה!');

    } catch (error) {
        console.error('Error in background process:', error.response ? error.response.data : error.message);
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
