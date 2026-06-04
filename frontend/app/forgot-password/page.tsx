import ForgotPasswordForm from '@/components/login/ForgotPasswordForm';
import { App } from 'antd';

export const metadata = {
  title: 'Forgot Password - ServiceApp',
  description: 'Reset your ServiceApp account password securely via email OTP.',
};

export default function ForgotPasswordPage() {
  return (
    <App>
      <ForgotPasswordForm />
    </App>
  );
}
