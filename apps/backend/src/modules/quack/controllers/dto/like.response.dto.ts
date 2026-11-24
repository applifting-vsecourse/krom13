import { ApiProperty } from '@nestjs/swagger';

export class LikeResponseDto {
  @ApiProperty({ description: 'Whether the viewer likes it after this call' })
  liked!: boolean;

  @ApiProperty({ description: 'Counted from the like rows after this call' })
  likeCount!: number;
}
