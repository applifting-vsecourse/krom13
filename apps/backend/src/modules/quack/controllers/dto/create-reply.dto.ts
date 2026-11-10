import { Mood, MOODS } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// No `poll`: polls are only for top-level quacks, and the controller's
// forbidNonWhitelisted turns one on a reply into a 400.
export class CreateReplyDto {
  @ApiProperty({
    description: 'Body of the reply',
    example: 'Good point!',
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;

  @ApiProperty({
    description: 'Mood of the reply',
    enum: MOODS,
    required: false,
  })
  @IsOptional()
  @IsIn(MOODS)
  mood?: Mood;
}
