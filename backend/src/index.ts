import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => console.log(`MiyuPay backend running on port ${PORT}`));
