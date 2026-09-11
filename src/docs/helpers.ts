import type { OpenAPIV3 } from 'openapi-types';
import { successSchema } from './components';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export function bearer(): OpenAPIV3.SecurityRequirementObject[] {
  return [{ bearerAuth: [] }];
}

export function jsonBody(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): OpenAPIV3.RequestBodyObject {
  return {
    required: true,
    content: { 'application/json': { schema } },
  };
}

export function multipartFile(): OpenAPIV3.RequestBodyObject {
  return {
    required: true,
    content: {
      'multipart/form-data': {
        schema: { $ref: '#/components/schemas/FileUpload' },
      },
    },
  };
}

export function ok(
  description: string,
  data: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  messageExample?: string,
): OpenAPIV3.ResponseObject {
  return {
    description,
    content: {
      'application/json': {
        schema: successSchema(data, messageExample),
      },
    },
  };
}

export function emptyOk(description: string, messageExample?: string): OpenAPIV3.ResponseObject {
  return ok(description, { type: 'object', additionalProperties: true }, messageExample);
}

export function standardErrors(
  extras: Array<'400' | '401' | '403' | '404' | '409' | '429'> = ['400', '401', '403'],
): Record<string, OpenAPIV3.ReferenceObject> {
  const map: Record<string, OpenAPIV3.ReferenceObject> = {};
  for (const code of extras) {
    const name =
      code === '400'
        ? 'BadRequest'
        : code === '401'
          ? 'Unauthorized'
          : code === '403'
            ? 'Forbidden'
            : code === '404'
              ? 'NotFound'
              : code === '409'
                ? 'Conflict'
                : 'TooManyRequests';
    map[code] = { $ref: `#/components/responses/${name}` };
  }
  return map;
}

export function idParam(name = 'id'): OpenAPIV3.ParameterObject {
  return {
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
  };
}

export function slugParam(name = 'slug'): OpenAPIV3.ParameterObject {
  return {
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 200 },
  };
}

export function pageParams(): OpenAPIV3.ParameterObject[] {
  return [
    { $ref: '#/components/parameters/Page' } as OpenAPIV3.ReferenceObject,
    { $ref: '#/components/parameters/Limit' } as OpenAPIV3.ReferenceObject,
  ] as unknown as OpenAPIV3.ParameterObject[];
}

/** Merge path item maps; later maps override conflicting methods carefully by merging methods. */
export function mergePaths(...maps: OpenAPIV3.PathsObject[]): OpenAPIV3.PathsObject {
  const out: OpenAPIV3.PathsObject = {};
  for (const map of maps) {
    for (const [path, item] of Object.entries(map)) {
      if (!item) continue;
      out[path] = out[path] ? { ...out[path], ...item } : { ...item };
    }
  }
  return out;
}

export function op(input: {
  operationId: string;
  tags: string[];
  summary: string;
  description?: string;
  security?: OpenAPIV3.SecurityRequirementObject[] | [];
  parameters?: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[];
  requestBody?: OpenAPIV3.RequestBodyObject;
  data?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
  message?: string;
  errors?: Array<'400' | '401' | '403' | '404' | '409' | '429'>;
  responses?: OpenAPIV3.ResponsesObject;
}): OpenAPIV3.OperationObject {
  const responses: OpenAPIV3.ResponsesObject = {
    '200': input.data
      ? ok(input.summary, input.data, input.message)
      : emptyOk(input.summary, input.message),
    ...standardErrors(input.errors ?? ['400', '401', '403', '404']),
    ...(input.responses ?? {}),
  };

  return {
    operationId: input.operationId,
    tags: input.tags,
    summary: input.summary,
    ...(input.description ? { description: input.description } : {}),
    ...(input.security !== undefined
      ? { security: input.security }
      : { security: bearer() }),
    ...(input.parameters ? { parameters: input.parameters } : {}),
    ...(input.requestBody ? { requestBody: input.requestBody } : {}),
    responses,
  };
}

export function publicOp(
  input: Omit<Parameters<typeof op>[0], 'security'>,
): OpenAPIV3.OperationObject {
  return op({ ...input, security: [] });
}
