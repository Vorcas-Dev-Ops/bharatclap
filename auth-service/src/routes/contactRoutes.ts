import { Router, Request, Response } from 'express';
import { ContactRepository } from '../repositories/contactRepository';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      res.status(400).json({ message: 'Name, email, and message are required.' });
      return;
    }

    const inquiry = await ContactRepository.createInquiry({
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : undefined,
      message: `${subject ? `[${subject.trim()}] ` : ''}${message.trim()}`,
    });

    res.status(201).json({
      success: true,
      message: 'Inquiry received successfully! We will get back to you shortly.',
      inquiryId: inquiry.id,
    });
  } catch (error: any) {
    console.error('[CONTACT INQUIRY ERROR]', error);
    res.status(500).json({ message: 'Failed to process inquiry. Please try again.' });
  }
});

export default router;
