import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AllowWhenPasswordChangeRequired,
  Ctx,
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
  type RequestContext,
} from '../access/access.decorators';
import {
  CreatedUserResponse,
  CreateUserDto,
  ListUsersQuery,
  TemporaryPasswordResponse,
  UpdateUserDto,
  UserPage,
  UserView,
} from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @AllowWhenPasswordChangeRequired()
  @ApiOkResponse({ type: UserView })
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserView> {
    return this.users.me(user);
  }

  @Get()
  @RequirePermissions('user:manage')
  @ApiOkResponse({ type: UserPage })
  list(@Query() query: ListUsersQuery): Promise<UserPage> {
    return this.users.list(query.page, query.pageSize, query.q, query.role);
  }

  @Get(':id')
  @RequirePermissions('user:manage')
  @ApiOkResponse({ type: UserView })
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<UserView> {
    return this.users.get(id);
  }

  @Post()
  @RequirePermissions('user:manage', 'role:manage')
  @ApiCreatedResponse({ type: CreatedUserResponse })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ) {
    return this.users.create(dto, actor, ctx);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('user:manage')
  @ApiOkResponse({ type: TemporaryPasswordResponse })
  resetPassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<TemporaryPasswordResponse> {
    return this.users.resetPassword(id, actor, ctx);
  }

  @Patch(':id')
  @RequirePermissions('user:manage')
  @ApiOkResponse({ type: UserView })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<UserView> {
    return this.users.update(id, dto, actor, ctx);
  }
}
