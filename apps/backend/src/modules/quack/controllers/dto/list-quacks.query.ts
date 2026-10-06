import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const MAX_SEARCH_LENGTH = 100;

export class ListQuacksQuery {
  @ApiPropertyOptional({
    description:
      'Search words. A quack matches when its text, its author name or its author username contains every word (case-insensitive). Ignored when shorter than 2 characters.',
    maxLength: MAX_SEARCH_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  q?: string;
}
