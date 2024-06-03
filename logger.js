import { createLogger, format, transports } from 'winston';

const enumerateErrorFormat = format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

export const logger = createLogger({
  format: format.combine(
    format.splat(),
    format.padLevels(),
    format.simple(),
    format.errors({ stack: true })
  ),
  transports: [new transports.Console()]
});

// const logger = createLogger({
//   level: config.env === 'development' ? 'debug' : 'info',
//   format: format.combine(
//     enumerateErrorFormat(),
//     config.env === 'development' ? format.colorize() : format.uncolorize(),
//     format.splat(),
//     format.printf(({ level, message }) => `${level}: ${message}`)
//   ),
//   transports: [
//     new transports.Console({
//       stderrLevels: ['error'],
//     }),
//   ],
// });
