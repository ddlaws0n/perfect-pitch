import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApp } from "./auth";
import { initializeLucia } from "../lib/lucia"; // Import initializeLucia
import { hash as argonHash, verify as argonVerify } from "argon2";

// This is our mock Lucia instance that initializeLucia will return in tests
const mockLuciaInstance = {
	createUser: vi.fn(),
	createKey: vi.fn(),
	useKey: vi.fn(),
	createSession: vi.fn(),
	createSessionCookie: vi.fn(),
	validateSession: vi.fn(),
	invalidateSession: vi.fn(),
	createBlankSessionCookie: vi.fn(),
	sessionCookieName: "auth_session",
	getUserAttributes: (attributes: any) => ({
		username: attributes.username,
		id: attributes.id,
	}),
};

// Mock the initializeLucia function from ../lib/lucia
vi.mock("../lib/lucia", () => ({
	initializeLucia: vi.fn(() => mockLuciaInstance), // initializeLucia now returns our mockLuciaInstance
}));

vi.mock("argon2", () => ({
	hash: vi.fn(),
	verify: vi.fn(),
}));

// Placeholder for the actual lucia instance that would be used by authApp
// In a real scenario, authApp would call initializeLucia(env)
// For testing, authApp will effectively use the mockLuciaInstance via the mock above.
// We need to ensure that when authApp is defined in auth.ts, it gets this mocked lucia.
// This might require auth.ts to accept lucia as a parameter or to call initializeLucia itself.
// For now, the tests will assume that authApp somehow uses the lucia instance that our mock of initializeLucia provides.

describe("Auth API Routes (/api/v1/auth)", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset specific mocks on the instance
		mockLuciaInstance.createUser.mockResolvedValue({
			userId: "mockUserId",
			username: "testuser",
			id: "mockUserId",
		} as any);
		mockLuciaInstance.createKey.mockResolvedValue({
			userId: "mockUserId",
		} as any);
		(argonHash as ReturnType<typeof vi.fn>).mockResolvedValue(
			"hashedTestPassword123"
		);
		mockLuciaInstance.createSessionCookie.mockReturnValue({
			name: "auth_session",
			value: "mockSessionValue",
			attributes: { path: "/" },
		} as any);
		mockLuciaInstance.createBlankSessionCookie.mockReturnValue({
			name: "auth_session",
			value: "",
			attributes: { path: "/", expires: new Date(0) },
		} as any);
	});

	describe("POST /api/v1/auth/register", () => {
		it("should register a new user successfully and return 201", async () => {
			const requestBody = { username: "testuser", password: "testPassword123" };

			const response = await authApp.request("/api/v1/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			});
			const responseBody: { message?: string; error?: string } =
				await response.json();

			expect(response.status).toBe(201);
			expect(responseBody.message).toBe("User registered successfully");
			expect(argonHash).toHaveBeenCalledOnce();
			expect(argonHash).toHaveBeenCalledWith("testPassword123");
			expect(mockLuciaInstance.createUser).toHaveBeenCalledOnce();
			expect(mockLuciaInstance.createKey).toHaveBeenCalledOnce();
			expect(mockLuciaInstance.createKey).toHaveBeenCalledWith(
				expect.objectContaining({
					hashed_password: "hashedTestPassword123",
				})
			);
		});

		it("should return 409 if username already exists", async () => {
			mockLuciaInstance.createUser.mockImplementationOnce(async () => {
				const err = new Error("Username already exists or key conflict");
				(err as any).code = "LUCIA_KEY_ID_CONFLICT"; // Or a code Lucia/adapter might use
				throw err;
			});

			const requestBody = {
				username: "existinguser",
				password: "testPassword123",
			};

			const response = await authApp.request("/api/v1/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			});
			const responseBody: { message?: string; error?: string } =
				await response.json();

			expect(response.status).toBe(409);
			expect(responseBody.error).toBe("Username already taken");
			expect(argonHash).toHaveBeenCalledOnce();
		});

		it("should return 400 for invalid input (e.g., missing password)", async () => {
			const requestBody = { username: "testuser_nopass" };

			const response = await authApp.request("/api/v1/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			});
			const responseBody: { message?: string; error?: string } =
				await response.json();

			expect(response.status).toBe(400);
			expect(responseBody.error).toMatch(/invalid input/i);
			expect(argonHash).not.toHaveBeenCalled();
			expect(mockLuciaInstance.createUser).not.toHaveBeenCalled();
			expect(mockLuciaInstance.createKey).not.toHaveBeenCalled();
		});

		it("should return 400 for invalid input (e.g., missing username)", async () => {
			const requestBody = { password: "testPassword123" };

			const response = await authApp.request("/api/v1/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			});
			const responseBody: { message?: string; error?: string } =
				await response.json();

			expect(response.status).toBe(400);
			expect(responseBody.error).toMatch(/invalid input/i);
			expect(argonHash).not.toHaveBeenCalled();
			expect(mockLuciaInstance.createUser).not.toHaveBeenCalled();
			expect(mockLuciaInstance.createKey).not.toHaveBeenCalled();
		});
	});

	// TODO: Add describe blocks for POST /login
	// TODO: Add describe blocks for POST /logout
	// TODO: Add describe blocks for GET /me (protected route)
});
