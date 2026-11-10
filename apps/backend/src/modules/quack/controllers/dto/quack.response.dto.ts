import { Mood, MOODS, Quack, Thread } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import { PollResponseDto } from './poll.response.dto';

class QuackUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;
}

export class QuackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ enum: MOODS, nullable: true })
  mood!: Mood | null;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ description: 'Live replies in the thread' })
  replyCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: QuackUserDto })
  user!: QuackUserDto;

  @ApiProperty({ type: PollResponseDto, nullable: true })
  poll!: PollResponseDto | null;

  static fromDomain(quack: Quack): QuackResponseDto {
    if (!quack.user || !quack.userId) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.user to be loaded for quack ${quack.id}`,
      );
    }
    return {
      id: quack.id,
      text: quack.text,
      mood: quack.mood,
      userId: quack.userId,
      replyCount: quack.replyCount ?? 0,
      createdAt: quack.createdAt,
      user: {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username,
      },
      poll: quack.poll ? PollResponseDto.fromDomain(quack.poll) : null,
    };
  }
}

class InReplyToDto {
  @ApiProperty({ description: 'True when the answered reply was deleted' })
  deleted!: boolean;

  @ApiProperty({ nullable: true, description: 'Null when deleted' })
  username!: string | null;
}

/**
 * One row of a thread page: the top-level quack or a reply. An emptied row
 * has `deleted: true`, no text, no author, no mood and no poll.
 */
export class ThreadItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  deleted!: boolean;

  @ApiProperty({ description: "Empty ('') when deleted" })
  text!: string;

  @ApiProperty({ enum: MOODS, nullable: true })
  mood!: Mood | null;

  @ApiProperty({ nullable: true, description: 'Null when deleted' })
  userId!: string | null;

  @ApiProperty({ type: QuackUserDto, nullable: true })
  user!: QuackUserDto | null;

  @ApiProperty({ nullable: true, description: 'The quack or reply answered' })
  parentId!: string | null;

  @ApiProperty({
    type: InReplyToDto,
    nullable: true,
    description:
      'Only for a reply to another reply (not to the top-level quack)',
  })
  inReplyTo!: InReplyToDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: PollResponseDto, nullable: true })
  poll!: PollResponseDto | null;

  static fromDomain(quack: Quack, thread: Quack[] = []): ThreadItemDto {
    const target =
      quack.parentId && quack.parentId !== quack.rootId
        ? thread.find((other) => other.id === quack.parentId)
        : undefined;
    return {
      id: quack.id,
      deleted: quack.deletedAt !== null,
      text: quack.text,
      mood: quack.mood,
      userId: quack.userId,
      user: quack.user
        ? {
            id: quack.user.id,
            name: quack.user.name,
            username: quack.user.username,
          }
        : null,
      parentId: quack.parentId,
      inReplyTo: target
        ? {
            deleted: target.deletedAt !== null,
            username: target.user?.username ?? null,
          }
        : null,
      createdAt: quack.createdAt,
      poll: quack.poll ? PollResponseDto.fromDomain(quack.poll) : null,
    };
  }
}

export class ThreadResponseDto {
  @ApiProperty({ type: ThreadItemDto })
  quack!: ThreadItemDto;

  @ApiProperty({ description: 'Live replies in the thread' })
  replyCount!: number;

  @ApiProperty({ type: [ThreadItemDto], description: 'Oldest first' })
  replies!: ThreadItemDto[];

  static fromDomain(thread: Thread): ThreadResponseDto {
    return {
      quack: ThreadItemDto.fromDomain(thread.quack),
      replyCount: thread.quack.replyCount ?? 0,
      replies: thread.replies.map((reply) => ThreadItemDto.fromDomain(reply)),
    };
  }
}
