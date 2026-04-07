import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F97316',
          borderRadius: 6,
        }}
      >
        <div
          style={{
            color: '#ffffff',
            fontSize: 20,
            fontWeight: 800,
            fontFamily: 'Georgia, serif',
          }}
        >
          NY
        </div>
      </div>
    ),
    { ...size }
  );
}
