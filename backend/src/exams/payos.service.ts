import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PayOS,
  type CreatePaymentLinkRequest,
  type PaymentLink,
  type Webhook,
  type WebhookData,
} from '@payos/node';

const checkoutHosts = new Set([
  'pay.payos.vn',
  'next.pay.payos.vn',
  'dev.pay.payos.vn',
  'next.dev.pay.payos.vn',
]);

export function validCheckoutUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !checkoutHosts.has(url.hostname)
  )
    throw new BadRequestException('Liên kết thanh toán không hợp lệ.');
  return url.toString();
}

@Injectable()
export class PayosService {
  private sdk?: PayOS;
  constructor(private readonly config: ConfigService) {}

  configured(): boolean {
    return ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'].every(
      (key) => Boolean(this.config.get<string>(key)?.trim()),
    );
  }

  private client(): PayOS {
    if (!this.configured())
      throw new ServiceUnavailableException(
        'Thanh toán đang được cấu hình. Vui lòng thử lại sau.',
      );
    return (this.sdk ??= new PayOS({
      clientId: this.config.getOrThrow<string>('PAYOS_CLIENT_ID').trim(),
      apiKey: this.config.getOrThrow<string>('PAYOS_API_KEY').trim(),
      checksumKey: this.config.getOrThrow<string>('PAYOS_CHECKSUM_KEY').trim(),
      timeout: 12000,
      maxRetries: 0,
      logLevel: 'off',
    }));
  }

  returnOrigin(): string {
    const value =
      this.config.get<string>('PAYOS_RETURN_ORIGIN') ||
      this.config.get<string>('app.frontendDomain');
    try {
      const url = new URL(value || '');
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !['', '/'].includes(url.pathname) ||
        (url.protocol !== 'https:' &&
          !(
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)
          ))
      )
        throw new Error();
      return url.origin;
    } catch {
      throw new ServiceUnavailableException(
        'Chưa cấu hình địa chỉ quay lại sau thanh toán.',
      );
    }
  }

  async create(data: CreatePaymentLinkRequest) {
    const sdk = this.client();
    try {
      const created = await sdk.paymentRequests.create(data);
      return { ...created, checkoutUrl: validCheckoutUrl(created.checkoutUrl) };
    } catch {
      // A timeout or a concurrent request may still have created the same order at payOS.
      // Reuse its orderCode instead of creating another invoice for this purchase.
      const found = await this.get(data.orderCode);
      if (found)
        return {
          ...found,
          paymentLinkId: found.id,
          currency: 'VND',
          checkoutUrl: this.checkoutFor(found.id),
        };
      throw new ServiceUnavailableException(
        'Chưa nhận được liên kết thanh toán. Đơn hàng vẫn được giữ để kiểm tra lại.',
      );
    }
  }

  checkoutFor(paymentLinkId: string): string {
    if (!/^[a-zA-Z0-9-]{16,100}$/.test(paymentLinkId))
      throw new BadRequestException('Mã thanh toán không hợp lệ.');
    return validCheckoutUrl('https://pay.payos.vn/web/' + paymentLinkId);
  }

  async get(orderCode: number): Promise<PaymentLink | null> {
    try {
      return await this.client().paymentRequests.get(orderCode);
    } catch (error) {
      if (
        (error as { code?: string; status?: number }).code === '231' ||
        (error as { status?: number }).status === 404
      )
        return null;
      throw new ServiceUnavailableException(
        'Chưa kiểm tra được giao dịch với payOS. Vui lòng thử lại.',
      );
    }
  }

  async verify(body: unknown): Promise<WebhookData> {
    const client = this.client();
    try {
      return await client.webhooks.verify(body as Webhook);
    } catch {
      throw new BadRequestException(
        'Chữ ký thông báo thanh toán không hợp lệ.',
      );
    }
  }
}
