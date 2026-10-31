import logoMark from '../assets/logo-mark.svg'

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <img
      className="logo-mark"
      src={logoMark}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  )
}

export function BrandLockup() {
  return (
    <div className="brand-lockup" aria-label="DocumentsLab">
      <Logo size={32} />
      <span className="brand-name">
        Documents<span>Lab</span>
      </span>
    </div>
  )
}
