import { PollResults } from '@/modules/quack/domain/poll';
import { ApiProperty } from '@nestjs/swagger';

class PollOptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ description: 'Number of votes for this answer' })
  votes!: number;
}

export class PollResponseDto {
  @ApiProperty({ type: [PollOptionResponseDto] })
  options!: PollOptionResponseDto[];

  @ApiProperty()
  totalVotes!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "The signed-in user's answer, or null if they haven't voted",
  })
  myOptionId!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Set once the author has closed the poll',
  })
  closedAt!: Date | null;

  static fromDomain(poll: PollResults): PollResponseDto {
    return {
      options: poll.options.map((option) => ({ ...option })),
      totalVotes: poll.totalVotes,
      myOptionId: poll.myOptionId,
      closedAt: poll.closedAt,
    };
  }
}
