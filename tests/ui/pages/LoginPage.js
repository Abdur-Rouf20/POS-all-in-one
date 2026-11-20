export class LoginPage {
  constructor(page) {
    this.page = page;
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.locator('.error-text');
  }

  async open() {
    await this.page.goto('/');
  }

  async signIn(email, password) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submitButton.click();
  }
}
