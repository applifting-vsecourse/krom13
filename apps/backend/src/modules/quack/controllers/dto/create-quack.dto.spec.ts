import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateQuackDto } from './create-quack.dto';

const check = async (
  body: object,
): Promise<{ dto: CreateQuackDto; errors: ValidationError[] }> => {
  const dto = plainToInstance(CreateQuackDto, body);
  return { dto, errors: await validate(dto) };
};

describe('CreateQuackDto poll', () => {
  it('accepts a quack without a poll', async () => {
    expect((await check({ text: 'hi' })).errors).toHaveLength(0);
  });

  it('accepts 2 to 6 answers and trims them', async () => {
    const { dto, errors } = await check({
      text: 'Lunch?',
      poll: { options: ['  Pizza ', 'Sushi'] },
    });
    expect(errors).toHaveLength(0);
    expect(dto.poll?.options).toEqual(['Pizza', 'Sushi']);

    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(
      (await check({ text: 'x', poll: { options: six } })).errors,
    ).toHaveLength(0);
  });

  it.each([
    ['one answer', ['Pizza']],
    ['seven answers', ['a', 'b', 'c', 'd', 'e', 'f', 'g']],
    ['an empty answer', ['Pizza', '   ']],
    ['an answer over 80 characters', ['Pizza', 'x'.repeat(81)]],
    ['duplicates ignoring case and spaces', ['Pizza', ' pizza ']],
  ])('rejects %s', async (_name, options) => {
    const { errors } = await check({ text: 'Lunch?', poll: { options } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an answer of exactly 80 characters', async () => {
    const { errors } = await check({
      text: 'x',
      poll: { options: ['x'.repeat(80), 'y'] },
    });
    expect(errors).toHaveLength(0);
  });
});
