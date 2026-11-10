import { ValidationPipe } from '@nestjs/common';
import { CreateReplyDto } from './create-reply.dto';

// The same pipe options the controller uses.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const check = (body: object): Promise<unknown> =>
  pipe.transform(body, { type: 'body', metatype: CreateReplyDto });

describe('CreateReplyDto', () => {
  it('accepts text and a mood', async () => {
    await expect(check({ text: 'hi', mood: 'happy' })).resolves.toMatchObject({
      text: 'hi',
      mood: 'happy',
    });
  });

  it('rejects a poll on a reply', async () => {
    await expect(
      check({ text: 'hi', poll: { options: ['a', 'b'] } }),
    ).rejects.toThrow();
  });

  it.each([
    [{ text: '' }],
    [{ text: 'x'.repeat(281) }],
    [{ text: 'a', mood: 'meh' }],
  ])('rejects %j', async (body) => {
    await expect(check(body)).rejects.toThrow();
  });
});
