import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import bcrypt from "bcrypt";
import { prisma } from "./db.js";
import { cfg } from "./config.js";

// local strategy for login with email + password
passport.use(
    new LocalStrategy(
        { usernameField: "email", passwordField: "password" },
        async (email, password, done) => {
            try {
                const user = await prisma.user.findUnique({
                    where: { email: email.toLowerCase().trim() },
                });

                if (!user || !user.passwordHash) {
                    return done(null, false, { message: "invalid credentials" });
                }

                const match = await bcrypt.compare(password, user.passwordHash);
                if (!match) {
                    return done(null, false, { message: "invalid credentials" });
                }

                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    )
);

// jwt strategy for protected routes
passport.use(
    new JwtStrategy(
        {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: cfg.jwtSecret,
        },
        async (payload, done) => {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: payload.sub },
                });

                if (!user) {
                    return done(null, false);
                }

                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    )
);

// serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (err) {
        done(err);
    }
});

export default passport;
