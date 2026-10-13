import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoteDto {
  @ApiProperty({ description: 'Id of the chosen answer of this poll' })
  @IsString()
  @IsNotEmpty()
  optionId!: string;
}
