import {
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
} from '@/modules/quack/domain/poll';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePollDto {
  @ApiProperty({
    description:
      'The answers, in display order. Trimmed; two answers that match ignoring case are rejected.',
    example: ['Pizza', 'Sushi'],
    minItems: MIN_POLL_OPTIONS,
    maxItems: MAX_POLL_OPTIONS,
    type: [String],
  })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item: unknown) =>
          typeof item === 'string' ? item.trim() : item,
        )
      : value,
  )
  @IsArray()
  @ArrayMinSize(MIN_POLL_OPTIONS)
  @ArrayMaxSize(MAX_POLL_OPTIONS)
  @ArrayUnique((option: string) => option.toLowerCase(), {
    message: 'Answers must be different from each other',
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(MAX_POLL_OPTION_LENGTH, { each: true })
  options!: string[];
}
