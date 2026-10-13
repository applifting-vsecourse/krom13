import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuackDto } from './dto/create-quack.dto';
import { ListQuacksQuery } from './dto/list-quacks.query';
import { PollResponseDto } from './dto/poll.response.dto';
import { QuackResponseDto } from './dto/quack.response.dto';
import { VoteDto } from './dto/vote.dto';

@ApiTags('quacks')
@Controller('quacks')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class QuacksController {
  constructor(private readonly quacksService: QuacksService) {}

  @Get()
  @ApiOperation({ summary: 'List all quacks' })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({ status: 400, description: 'Search query too long' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(
    @User() user: Identity,
    @Query() query: ListQuacksQuery,
  ): Promise<QuackResponseDto[]> {
    const quacks = await this.quacksService.getQuacks(user, query.q);
    return quacks.map(QuackResponseDto.fromDomain);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a quack' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid quack or poll answers' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async create(
    @User() user: Identity,
    @Body() body: CreateQuackDto,
  ): Promise<QuackResponseDto> {
    const quack = await this.quacksService.createQuack(user, {
      text: body.text,
      mood: body.mood,
      pollOptions: body.poll?.options,
    });
    return QuackResponseDto.fromDomain(quack);
  }

  @Put(':id/vote')
  @ApiOperation({
    summary: 'Vote on a poll, or move your vote to another answer',
    description:
      'Sets your single vote on this poll. Repeating the same request changes nothing.',
  })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 400, description: 'Answer is not part of this poll' })
  @ApiResponse({ status: 404, description: 'No such poll' })
  @ApiResponse({ status: 409, description: 'The poll is closed' })
  async vote(
    @User() user: Identity,
    @Param('id') id: string,
    @Body() body: VoteDto,
  ): Promise<PollResponseDto> {
    const results = await this.quacksService.vote(user, id, body.optionId);
    return PollResponseDto.fromDomain(results);
  }

  @Post(':id/poll/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close a poll (author only, permanent)',
    description: 'Closing an already closed poll changes nothing.',
  })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 403, description: 'Only the author can close' })
  @ApiResponse({ status: 404, description: 'No such poll' })
  async closePoll(
    @User() user: Identity,
    @Param('id') id: string,
  ): Promise<PollResponseDto> {
    const results = await this.quacksService.closePoll(user, id);
    return PollResponseDto.fromDomain(results);
  }
}
