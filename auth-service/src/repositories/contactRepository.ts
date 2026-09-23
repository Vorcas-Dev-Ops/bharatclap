import { getDb } from '../config/db';

export interface ContactInquiryEntity {
  id: string;
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  message: string;
  created_at: Date;
}

export class ContactRepository {
  static async createInquiry(data: {
    name: string;
    email?: string;
    phone?: string;
    message: string;
  }): Promise<ContactInquiryEntity> {
    const pool = getDb();
    const res = await pool.query(
      `INSERT INTO auth.contact_inquiries (name, email, phone, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.email || null, data.phone || null, data.message]
    );
    const row = res.rows[0];
    return { ...row, _id: row.id };
  }
}
