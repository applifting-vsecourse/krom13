import { Mood, MOODS } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateQuackDto {
  @ApiProperty({
    description: 'Body of the quack',
    example: 'Hello, world!',
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;

  @ApiProperty({
    description: 'Mood of the quack',
    enum: MOODS,
    required: false,
  })
  @IsOptional()
  @IsIn(MOODS)
  mood?: Mood;
}
